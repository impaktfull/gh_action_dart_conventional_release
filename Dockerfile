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
RUN apt-get -y install git

RUN git config --global --add safe.directory "$GITHUB_WORKSPACE"

# Copy the rest of your action's code
COPY . .

# Run `node /index.js`
ENTRYPOINT ["node", "/index.js"]
