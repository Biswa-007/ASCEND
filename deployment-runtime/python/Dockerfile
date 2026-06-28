FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer-cached unless requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

EXPOSE 8000

# Try common Python entrypoints in priority order.
# If none are found the container exits with a clear error message.
CMD ["sh", "-c", "\
  if [ -f app.py ]; then python app.py; \
  elif [ -f main.py ]; then python main.py; \
  elif [ -f server.py ]; then python server.py; \
  elif [ -f wsgi.py ]; then python wsgi.py; \
  else echo 'ERROR: No Python entrypoint found (expected app.py, main.py, server.py, or wsgi.py)' && exit 1; \
  fi"]
