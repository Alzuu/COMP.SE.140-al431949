import requests
import os
import time
import sys
from datetime import datetime
from pathlib import Path


# Send an HTTP POST request to a given URL with text data
def send_request(url, text, headers):
    try:
        requests.post(url, json={"data": text}, headers=headers)
        return text
    except Exception as e:
        return f"Error {str(e)}"


# Write text data to a log file
def write_log(file, text):
    if not text:
        with open(Path(file), "w") as log_file:
            log_file.write("")
    else:
        with open(Path(file), "a") as log_file:
            log_file.write(f"{text}\n")


# Exit the application
def exit_app(url, headers):
    print("exit service1")
    stop = "STOP"
    try:
        # Send a final request with "STOP" to the URL and write it to the log file
        send_request(url, stop, headers)
        write_log(Path(file_path), stop)
    except Exception as e:
        pass
    finally:
        sys.exit(0)


if __name__ == "__main__":
    file_path = "../logs/service1.log"
    dir_path = "../logs"

    # Create the log directory if it doesn't exist
    if not Path(dir_path).exists():
        Path(dir_path).mkdir(parents=True, exist_ok=True)

    # Retrieve environment variables for the target host and port
    target_host = os.getenv("TARGET_HOST")
    target_port = os.getenv("TARGET_PORT")

    # Combine the host and port to form the target address
    target = f"{target_host}:{target_port}"

    # Create the URL for HTTP requests using the target address
    url = f"http://{target}/"

    headers = {
        "Content-type": "application/json",
        "Accept": "application/json, text/plain",
    }

    # Initialize the log file with an empty line
    write_log(Path(file_path), "")

    # Send 20 requests with a pause of 2 seconds between each request
    for i in range(1, 21):
        current_datetime = datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        text = f"{i} {current_datetime} {target}"
        result = send_request(url, text, headers)
        # Write the result to the log file
        write_log(Path(file_path), result)
        time.sleep(2)

    # Exit the application
    exit_app(url, headers)
