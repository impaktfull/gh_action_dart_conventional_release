FROM node:slim
LABEL "com.github.actions.name"="Dart Conventional Release"
LABEL "com.github.actions.description"="Automating version bump for conventional dart releases"
LABEL "com.github.actions.icon"="upload-cloud"
LABEL "com.github.actions.color"="blue"

# Install system dependencies for Git, wget, gnupg, Curl, and Unzip
RUN apt-get update && apt-get install -y git wget gnupg curl unzip xz-utils

# Install Dart
RUN apt-get update && apt-get install -y apt-transport-https
RUN sh -c 'wget -qO- https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -'
RUN sh -c 'wget -qO- https://storage.googleapis.com/download.dartlang.org/linux/debian/dart_stable.list > /etc/apt/sources.list.d/dart_stable.list'
RUN apt-get update && apt-get install -y dart

# Add Dart to PATH
ENV PATH="/usr/lib/dart/bin:${PATH}"

# Install npm dependencies
COPY package*.json ./
RUN npm install

# Install Dart dependencies
COPY pubspec.lock ./
COPY pubspec.yaml ./
RUN dart pub get

# Copy the rest of your action's code
COPY . .

# Run `node /index.js`
ENTRYPOINT ["node", "/index.js"]
