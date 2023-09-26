import requests
import os
import time
import sys
from datetime import datetime
from pathlib import Path


def send_request(url, text, headers):
    try:
        requests.post(url, json={"data": text}, headers=headers)
        return text
    except Exception as e:
        return f"Error {str(e)}"


def write_log(file, text):
    if not text:
        with open(Path(file), "w") as log_file:
            log_file.write("")
    else:
        with open(Path(file), "a") as log_file:
            log_file.write(f"{text}\n")


def exit_app(url, headers):
    print("exit service1")
    stop = "STOP"
    try:
        send_request(url, stop, headers)
        write_log(Path(file_path), stop)
    except Exception as e:
        pass
    finally:
        sys.exit(0)


if __name__ == "__main__":
    file_path = "../logs/service1.log"
    dir_path = "../logs"

    if not Path(dir_path).exists():
        Path(dir_path).mkdir(parents=True, exist_ok=True)

    target_host = os.getenv("TARGET_HOST")
    target_port = os.getenv("TARGET_PORT")

    target = f"{target_host}:{target_port}"

    url = f"http://{target}/"

    headers = {
        "Content-type": "application/json",
        "Accept": "application/json, text/plain",
    }

    write_log(Path(file_path), "")

    for i in range(1, 21):
        current_datetime = datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        text = f"{i} {current_datetime} {target}"
        result = send_request(url, text, headers)
        write_log(Path(file_path), result)
        time.sleep(2)

    exit_app(url, headers)
