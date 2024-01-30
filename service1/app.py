import requests
import os
import time
import sys
import pika
from datetime import datetime
import socket
from enum import Enum
import threading


mq_host = os.getenv("MQ_HOST")
mq_port = os.getenv("MQ_PORT")
mq_exchange = os.getenv("MQ_EXCHANGE")
mq_message_routing_key = os.getenv("MQ_MESSAGE_ROUTING_KEY")
mq_log_routing_key = os.getenv("MQ_LOG_ROUTING_KEY")

i = 1
state = "INIT"
url = ""
connection = None
channel = None
send_message_thread = None


class State(Enum):
    INIT = "INIT"
    PAUSED = "PAUSED"
    RUNNING = "RUNNING"
    SHUTDOWN = "SHUTDOWN"


# Connect to the message queue using environment variables
def pika_connect():
    global connection, channel
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(host=mq_host, port=mq_port)
    )
    channel = connection.channel()
    channel.exchange_declare(exchange=mq_exchange, exchange_type="topic", durable=True)


def pika_connect_and_consume():
    mq_state_queue = os.getenv("MQ_STATE_QUEUE")
    mq_state_service1_routing_key = os.getenv("MQ_STATE_SERVICE1_ROUTING_KEY")

    connection = pika.BlockingConnection(
        pika.ConnectionParameters(host=mq_host, port=mq_port)
    )
    channel = connection.channel()
    channel.exchange_declare(exchange=mq_exchange, exchange_type="topic", durable=True)

    channel.queue_declare(queue=mq_state_queue, durable=True)
    channel.queue_bind(
        exchange=mq_exchange,
        queue=mq_state_queue,
        routing_key=mq_state_service1_routing_key,
    )
    channel.basic_consume(
        queue=mq_state_queue,
        on_message_callback=handle_status_change,
        auto_ack=True,
    )
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        channel.stop_consuming()
        connection.close()


def handle_status_change(ch, method, properties, body):
    global state
    newState = body.decode("utf-8")
    states = set(item.value for item in State)
    if newState not in states:
        print(f"Invalid state: {newState}")
        return
    if newState == State.INIT.value:
        init()
    elif newState == State.SHUTDOWN.value:
        exit_app(connection, channel)
    elif newState == State.PAUSED.value:
        state = newState
    else:
        state = newState


def init():
    global i, state
    i = 1
    state = State.INIT.value


def send_message():
    global i
    while state != State.SHUTDOWN.value:
        try:
            if state == State.RUNNING.value:
                current_datetime = datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
                message = f"SND {i} {current_datetime} {target}"
                channel.basic_publish(
                    exchange=mq_exchange,
                    routing_key=mq_message_routing_key,
                    body=message,
                )
                log = send_request(url, message)
                channel.basic_publish(
                    exchange=mq_exchange, routing_key=mq_log_routing_key, body=log
                )
                i += 1
        except Exception as e:
            print(e)
        time.sleep(2)


# Send an HTTP POST request to a given URL with text data
def send_request(url, text):
    try:
        res = requests.post(url, json={"data": text})
        timestamp = datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        log = f"{res.status_code} {timestamp}"
        return log
    except Exception as e:
        log = f"Error {str(e)}"
        return log


# Exit the application by publishing a stop message to the message queue
# and closing the connection
def exit_app(connection, channel):
    global state
    state = State.SHUTDOWN.value
    stop = "SND STOP"
    try:
        channel.basic_publish(
            exchange=mq_exchange, routing_key=mq_log_routing_key, body=stop
        )
        connection.close()
    except Exception as e:
        print(f"Service1 Error: {str(e)}")
        pass
    finally:
        sys.exit(0)


if __name__ == "__main__":
    # Retrieve environment variables for the target host and port
    target_host = os.getenv("TARGET_HOST")
    target_port = os.getenv("TARGET_PORT")

    # Retrieve target IP by target hostname
    target_ip = socket.gethostbyname(target_host)

    # Combine the ip address and port to form the target address
    target = f"{target_ip}:{target_port}"

    # Create the URL for HTTP requests using the target address
    url = f"http://{target}/"

    pika_connect()
    init()

    pika_consume_thread = threading.Thread(target=pika_connect_and_consume)
    send_message_thread = threading.Thread(target=send_message)

    pika_consume_thread.start()
    send_message_thread.start()

    pika_consume_thread.join()
    send_message_thread.join()
