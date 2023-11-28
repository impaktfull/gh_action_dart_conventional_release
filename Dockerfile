FROM node:slim
LABEL "com.github.actions.name"="Dart Conventional Release"
LABEL "com.github.actions.description"="Automating version bump for conventional dart releases"
LABEL "com.github.actions.icon"="upload-cloud"
LABEL "com.github.actions.color"="blue"

# Install system dependencies for Git, Curl, and Unzip
RUN apt-get update && apt-get install -y git curl unzip xz-utils

# Install Dart and Flutter
# Set the Flutter version you want to use
ENV FLUTTER_VERSION=stable
RUN git clone --branch $FLUTTER_VERSION https://github.com/flutter/flutter.git /usr/local/flutter

# Add Flutter to PATH
ENV PATH="/usr/local/flutter/bin:${PATH}"

# Add Dart to PATH
ENV PATH="/usr/local/flutter/bin/cache/dart-sdk/bin:${PATH}"

# Install npm dependencies
COPY package*.json ./
RUN npm install

# Precache Flutter
RUN flutter precache

# Copy the rest of your action's code
COPY . .

# Run `node /index.js`
ENTRYPOINT ["node", "/index.js"]
