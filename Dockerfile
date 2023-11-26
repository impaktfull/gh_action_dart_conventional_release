FROM node:slim
LABEL "com.github.actions.name"="Dart Conventional Release"
LABEL "com.github.actions.description"="Automating version bump for conventional dart releases"
LABEL "com.github.actions.icon"="upload-cloud"
LABEL "com.github.actions.color"="blue"

# Copy the package.json and package-lock.json
COPY package*.json ./
RUN npm install -g npm@7.0.3

# Install dependencies
RUN apt-get update
RUN apt-get -y install git

RUN npm ci --only=production

# Copy the rest of your action's code
COPY . .

# Run `node /index.js`
ENTRYPOINT ["node", "/index.js"]
