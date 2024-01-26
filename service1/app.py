import requests
import os
import time
import sys
import pika
from datetime import datetime
import socket
from enum import Enum

state_queue = "state-service1"
i = 1
state = "INIT"


class State(Enum):
    INIT = "INIT"
    PAUSED = "PAUSED"
    RUNNING = "RUNNING"
    SHUTDOWN = "SHUTDOWN"


# Connect to the message queue using environment variables
def pika_connect():
    mq_host = os.getenv("MQ_HOST")
    mq_port = os.getenv("MQ_PORT")
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(host=mq_host, port=mq_port)
    )
    channel = connection.channel()
    channel.exchange_declare(exchange="topic_logs", exchange_type="topic", durable=True)

    channel.queue_declare(queue=state_queue, durable=True)
    channel.queue_bind(
        exchange="topic_logs", queue=state_queue, routing_key=state_queue
    )
    channel.basic_consume(
        queue=state_queue,
        on_message_callback=handle_status_change,
        auto_ack=True,
    )

    return connection, channel


def handle_status_change(ch, method, properties, body):
    global i, state
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
        state = State.PAUSED.value
    else:
        state = State.RUNNING.value


def init():
    global i, state
    i = 1
    state = State.RUNNING.value


def send_message(url, channel):
    global i, state
    if state == State.RUNNING.value:
        try:
            current_datetime = datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
            message = f"SND {i} {current_datetime} {target}"
            channel.basic_publish(
                exchange="topic_logs", routing_key="message.#", body=message
            )
            log = send_request(url, message)
            channel.basic_publish(exchange="topic_logs", routing_key="log.#", body=log)
            i += 1
        except Exception as e:
            print(e)

    time.sleep(2)
    send_message(url, channel)


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
    print("exit service1")
    stop = "SND STOP"
    try:
        channel.basic_publish(exchange="topic_logs", routing_key="log.#", body=stop)
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

    connection, channel = pika_connect()
    init()

    send_message(url, channel)
