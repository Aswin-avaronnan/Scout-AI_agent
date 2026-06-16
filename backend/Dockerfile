FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if any needed
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# HF Spaces requires port 7860
ENV PORT=7860
EXPOSE 7860

CMD ["python", "main.py"]
