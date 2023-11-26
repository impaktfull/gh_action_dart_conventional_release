# Use a Debian image as the base
FROM debian:buster

LABEL "com.github.actions.name"="Dart Conventional Release"
LABEL "com.github.actions.description"="Automating version bump for conventional dart releases"
LABEL "com.github.actions.icon"="upload-cloud"
LABEL "com.github.actions.color"="blue"

# Install curl, gnupg, and other necessary utilities
RUN apt-get update && apt-get install -y curl gnupg software-properties-common git

# Add Dart stable repository
RUN sh -c 'curl https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -'
RUN sh -c 'curl https://storage.googleapis.com/download.dartlang.org/linux/debian/dart_stable.list > /etc/apt/sources.list.d/dart_stable.list'

# Install Dart
RUN apt-get update && apt-get install -y dart

# Install Node.js and npm
RUN curl -fsSL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs

# Confirm installations
RUN dart --version
RUN node --version
RUN npm --version
RUN git --version

# Copy the package.json and package-lock.json
COPY package*.json ./
RUN npm install -g npm@latest
RUN npm install

# Copy the rest of your action's code
COPY . .

# Run `node /index.js`
ENTRYPOINT ["node", "/index.js"]
