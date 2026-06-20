
#!/bin/bash

# This script leverages the enhanced sync logic for deployment
echo "🚀 Starting VisioNode Web Deployment..."

chmod +x sync.sh
./sync.sh

if [ $? -eq 0 ]; then
    echo "✅ Web Deployment Triggered!"
    echo "🌐 Vercel is now building from your GitHub Registry."
else
    echo "❌ Deployment trigger failed."
    exit 1
fi
