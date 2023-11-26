FROM node:slim
LABEL "com.github.actions.name"="Dart Conventional Release"
LABEL "com.github.actions.description"="Automating version bump for conventional dart releases"
LABEL "com.github.actions.icon"="upload-cloud"
LABEL "com.github.actions.color"="blue"

# Copy the package.json and package-lock.json
COPY package*.json ./
RUN npm install -g npm@latest
RUN npm install

# Install dependencies
RUN apt-get update
# Install git
RUN apt-get -y install git
# Install wget
RUN apt-get install -y wget 
# Install gpg-agent
RUN apt-get install gpg-agent
# Install dart
RUN apt-get install apt-transport-https
RUN wget -qO- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/dart.gpg
RUN echo 'deb [signed-by=/usr/share/keyrings/dart.gpg arch=amd64] https://storage.googleapis.com/download.dartlang.org/linux/debian stable main' | tee /etc/apt/sources.list.d/dart_stable.list
RUN apt-get update
RUN apt-get install dart

# Copy the rest of your action's code
COPY . .

# Run `node /index.js`
ENTRYPOINT ["node", "/index.js"]
