# Find the Dockerfile at this URL
# https://github.com/Azure/azure-functions-docker/blob/dev/host/4/bullseye/amd64/python/python39/python39-core-tools.Dockerfile
FROM mcr.microsoft.com/azure-functions/python:4-python3.9-core-tools

# Copy library scripts to execute
COPY library-scripts/*.sh library-scripts/*.env /tmp/library-scripts/

# Install Node.js, Azure Static Web Apps CLI and Azure Functions Core Tools
ARG NODE_VERSION="16"
ARG CORE_TOOLS_VERSION="4"
ENV NVM_DIR="/usr/local/share/nvm" \
    NVM_SYMLINK_CURRENT=true \
    PATH="${NVM_DIR}/current/bin:${PATH}"
RUN bash /tmp/library-scripts/node-debian.sh "${NVM_DIR}" "${NODE_VERSION}" "${USERNAME}" \
    && su vscode -c "umask 0002 && . /usr/local/share/nvm/nvm.sh && nvm install ${NODE_VERSION} 2>&1" \
    && su vscode -c "umask 0002 && npm install --cache /tmp/empty-cache -g @azure/static-web-apps-cli" \
    && if [ $CORE_TOOLS_VERSION != "4" ]; then apt-get remove -y azure-functions-core-tools-4 && apt-get update && apt-get install -y "azure-functions-core-tools-${CORE_TOOLS_VERSION}"; fi \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# [Optional] Uncomment this section to install additional OS packages.
# RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#     && apt-get -y install --no-install-recommends <your-package-list-here>

# [Optional] Uncomment this line to install global node packages.
# RUN su vscode -c "source /usr/local/share/nvm/nvm.sh && npm install -g <your-package-here>" 2>&1