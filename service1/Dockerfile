FROM python:3.11.5-slim as base

WORKDIR /app

COPY requirements.txt requirements.txt

RUN python -m pip install -r requirements.txt

COPY . .

CMD [ "python3", "./app.py" ]