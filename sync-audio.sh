
#!/bin/bash

# Script to sync audio files from host uploads directory to Asterisk container
# Converts MP3 to WAV format and copies to container

UPLOADS_DIR="./uploads"
CONTAINER_NAME="asterisk-p1"
CONTAINER_AUDIO_DIR="/usr/share/asterisk/sounds/uploads"

echo "Starting audio sync process..."

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "Error: Container $CONTAINER_NAME is not running"
    exit 1
fi

# Create temporary directory for converted files
TEMP_DIR=$(mktemp -d)
echo "Using temporary directory: $TEMP_DIR"

# Process each MP3 file in uploads directory
for mp3_file in "$UPLOADS_DIR"/*.mp3; do
    if [[ -f "$mp3_file" ]]; then
        filename=$(basename "$mp3_file" .mp3)
        wav_file="$TEMP_DIR/${filename}.wav"
        
        echo "Converting $mp3_file to WAV format..."
        
        # Convert MP3 to WAV using ffmpeg
        ffmpeg -i "$mp3_file" -acodec pcm_s16le -ar 44100 -ac 1 "$wav_file" -y 2>/dev/null
        
        if [[ $? -eq 0 ]]; then
            echo "✓ Converted: $filename.mp3 -> $filename.wav"
            
            # Copy to container
            docker cp "$wav_file" "$CONTAINER_NAME:$CONTAINER_AUDIO_DIR/"
            
            if [[ $? -eq 0 ]]; then
                echo "✓ Copied to container: $filename.wav"
            else
                echo "✗ Failed to copy to container: $filename.wav"
            fi
        else
            echo "✗ Failed to convert: $filename.mp3"
        fi
    fi
done

# Copy existing WAV files directly
for wav_file in "$UPLOADS_DIR"/*.wav; do
    if [[ -f "$wav_file" ]]; then
        filename=$(basename "$wav_file")
        echo "Copying existing WAV file: $filename"
        
        docker cp "$wav_file" "$CONTAINER_NAME:$CONTAINER_AUDIO_DIR/"
        
        if [[ $? -eq 0 ]]; then
            echo "✓ Copied to container: $filename"
        else
            echo "✗ Failed to copy to container: $filename"
        fi
    fi
done

# Clean up temporary directory
rm -rf "$TEMP_DIR"
echo "Audio sync completed!"

# List files in container
echo "Files in container audio directory:"
docker exec "$CONTAINER_NAME" ls -la "$CONTAINER_AUDIO_DIR"
