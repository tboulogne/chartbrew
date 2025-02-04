echo "===== SCRIPT START ====";

export REACT_APP_API_HOST=${REACT_APP_API_HOST}
export REACT_APP_CLIENT_HOST=${REACT_APP_CLIENT_HOST}
export REACT_APP_ONE_ACCOUNT_EXTERNAL_ID=${REACT_APP_ONE_ACCOUNT_EXTERNAL_ID}

cd server
NODE_ENV=production nohup node index.js &

cd ../client
mkdir -p dist

# Build the UI in the background
nohup sh -c 'echo "The UI is rebuilding. Please wait..." && npm run build && echo "UI built successfully!" && cp -rf build/* dist/' &
