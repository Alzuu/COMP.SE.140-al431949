import requests
import os
import time
import sys
import pika
from datetime import datetime
import socket


# Connect to the message queue using environment variables
def pika_connect():
    mq_host = os.getenv("MQ_HOST")
    mq_port = os.getenv("MQ_PORT")
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(host=mq_host, port=mq_port)
    )
    channel = connection.channel()
    channel.exchange_declare(exchange="topic_logs", exchange_type="topic", durable=True)
    return connection, channel


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

    # Send 20 requests with a pause of 2 seconds between each request
    for i in range(1, 21):
        try:
            current_datetime = datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
            message = f"SND {i} {current_datetime} {target}"
            channel.basic_publish(
                exchange="topic_logs", routing_key="message.#", body=message
            )
            log = send_request(url, message)
            channel.basic_publish(exchange="topic_logs", routing_key="log.#", body=log)
            time.sleep(2)
        except Exception as e:
            print(e)

    # Exit the application
    exit_app(connection, channel)
