FROM node:slim
LABEL "com.github.actions.name"="Dart Conventional Release"
LABEL "com.github.actions.description"="Automating version bump for conventional dart releases"
LABEL "com.github.actions.icon"="upload-cloud"
LABEL "com.github.actions.color"="blue"

# Install system dependencies for Git, Curl, and Unzip
RUN apt-get update && apt-get install -y git curl unzip xz-utils

# Copy the package.json and package-lock.json
COPY package*.json ./
RUN npm install

# Install Dart and Flutter
# Set the Flutter version you want to use
ENV FLUTTER_VERSION=stable
RUN git clone --branch $FLUTTER_VERSION https://github.com/flutter/flutter.git /usr/local/flutter

# Add Flutter to PATH
ENV PATH="/usr/local/flutter/bin:/usr/local/flutter/bin/cache/dart-sdk/bin:${PATH}"

# Pre-download development binaries and libraries
RUN flutter precache

# Run basic check to download Dark SDK
RUN flutter doctor

# Copy the rest of your action's code
COPY . .

# Run `node /index.js`
ENTRYPOINT ["node", "/index.js"]
