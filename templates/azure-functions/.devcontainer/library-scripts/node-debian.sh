#!/bin/bash
#-------------------------------------------------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
#-------------------------------------------------------------------------------------------------------------
#
# Docs: https://github.com/microsoft/vscode-dev-containers/blob/main/script-library/docs/node.md
# Maintainer: The VS Code and Codespaces Teams
#
# Syntax: ./node-debian.sh [directory to install nvm] [node version to install (use "none" to skip)] [non-root user] [Update rc files flag] [install node-gyp deps]

export NVM_DIR=${1:-"/usr/local/share/nvm"}
export NODE_VERSION=${2:-"lts"}
USERNAME=${3:-"automatic"}
UPDATE_RC=${4:-"true"}
INSTALL_TOOLS_FOR_NODE_GYP="${5:-true}"
export NVM_VERSION="0.38.0"

set -e

if [ "$(id -u)" -ne 0 ]; then
    echo -e 'Script must be run as root. Use sudo, su, or add "USER root" to your Dockerfile before running this script.'
    exit 1
fi

# Ensure that login shells get the correct path if the user updated the PATH using ENV.
rm -f /etc/profile.d/00-restore-env.sh
echo "export PATH=${PATH//$(sh -lc 'echo $PATH')/\$PATH}" > /etc/profile.d/00-restore-env.sh
chmod +x /etc/profile.d/00-restore-env.sh

# Determine the appropriate non-root user
if [ "${USERNAME}" = "auto" ] || [ "${USERNAME}" = "automatic" ]; then
    USERNAME=""
    POSSIBLE_USERS=("vscode" "node" "codespace" "$(awk -v val=1000 -F ":" '$3==val{print $1}' /etc/passwd)")
    for CURRENT_USER in ${POSSIBLE_USERS[@]}; do
        if id -u ${CURRENT_USER} > /dev/null 2>&1; then
            USERNAME=${CURRENT_USER}
            break
        fi
    done
    if [ "${USERNAME}" = "" ]; then
        USERNAME=root
    fi
elif [ "${USERNAME}" = "none" ] || ! id -u ${USERNAME} > /dev/null 2>&1; then
    USERNAME=root
fi

updaterc() {
    if [ "${UPDATE_RC}" = "true" ]; then
        echo "Updating /etc/bash.bashrc and /etc/zsh/zshrc..."
        if [[ "$(cat /etc/bash.bashrc)" != *"$1"* ]]; then
            echo -e "$1" >> /etc/bash.bashrc
        fi
        if [ -f "/etc/zsh/zshrc" ] && [[ "$(cat /etc/zsh/zshrc)" != *"$1"* ]]; then
            echo -e "$1" >> /etc/zsh/zshrc
        fi
    fi
}

# Function to run apt-get if needed
apt_get_update_if_needed()
{
    if [ ! -d "/var/lib/apt/lists" ] || [ "$(ls /var/lib/apt/lists/ | wc -l)" = "0" ]; then
        echo "Running apt-get update..."
        apt-get update
    else
        echo "Skipping apt-get update."
    fi
}

# Checks if packages are installed and installs them if not
check_packages() {
    if ! dpkg -s "$@" > /dev/null 2>&1; then
        apt_get_update_if_needed
        apt-get -y install --no-install-recommends "$@"
    fi
}

# Ensure apt is in non-interactive to avoid prompts
export DEBIAN_FRONTEND=noninteractive

# Install dependencies
check_packages apt-transport-https curl ca-certificates tar gnupg2 dirmngr

# Install yarn
if type yarn > /dev/null 2>&1; then
    echo "Yarn already installed."
else
    # Import key safely (new method rather than deprecated apt-key approach) and install
    curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | gpg --dearmor > /usr/share/keyrings/yarn-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/yarn-archive-keyring.gpg] https://dl.yarnpkg.com/debian/ stable main" > /etc/apt/sources.list.d/yarn.list
    apt-get update
    apt-get -y install --no-install-recommends yarn
fi

# Adjust node version if required
if [ "${NODE_VERSION}" = "none" ]; then
    export NODE_VERSION=
elif [ "${NODE_VERSION}" = "lts" ]; then
    export NODE_VERSION="lts/*"
fi

# Create a symlink to the installed version for use in Dockerfile PATH statements
export NVM_SYMLINK_CURRENT=true

# Install the specified node version if NVM directory already exists, then exit
if [ -d "${NVM_DIR}" ]; then
    echo "NVM already installed."
    if [ "${NODE_VERSION}" != "" ]; then
       su ${USERNAME} -c ". $NVM_DIR/nvm.sh && nvm install ${NODE_VERSION} && nvm clear-cache"
    fi
    exit 0
fi

# Create nvm group, nvm dir, and set sticky bit
if ! cat /etc/group | grep -e "^nvm:" > /dev/null 2>&1; then
    groupadd -r nvm
fi
umask 0002
usermod -a -G nvm ${USERNAME}
mkdir -p ${NVM_DIR}
chown :nvm ${NVM_DIR}
chmod g+s ${NVM_DIR}
su ${USERNAME} -c "$(cat << EOF
    set -e
    umask 0002
    # Do not update profile - we'll do this manually
    export PROFILE=/dev/null
    curl -so- https://raw.githubusercontent.com/nvm-sh/nvm/v${NVM_VERSION}/install.sh | bash 
    source ${NVM_DIR}/nvm.sh
    if [ "${NODE_VERSION}" != "" ]; then
        nvm alias default ${NODE_VERSION}
    fi
    nvm clear-cache 
EOF
)" 2>&1
# Update rc files
if [ "${UPDATE_RC}" = "true" ]; then
updaterc "$(cat <<EOF
export NVM_DIR="${NVM_DIR}"
[ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh"
[ -s "\$NVM_DIR/bash_completion" ] && . "\$NVM_DIR/bash_completion"
EOF
)"
fi

# If enabled, verify "python3", "make", "gcc", "g++" commands are available so node-gyp works - https://github.com/nodejs/node-gyp
if [ "${INSTALL_TOOLS_FOR_NODE_GYP}" = "true" ]; then
    echo "Verifying node-gyp OS requirements..."
    to_install=""
    if ! type make > /dev/null 2>&1; then
        to_install="${to_install} make"
    fi
    if ! type gcc > /dev/null 2>&1; then
        to_install="${to_install} gcc"
    fi
    if ! type g++ > /dev/null 2>&1; then
        to_install="${to_install} g++"
    fi
    if ! type python3 > /dev/null 2>&1; then
        to_install="${to_install} python3-minimal"
    fi
    if [ ! -z "${to_install}" ]; then
        apt_get_update_if_needed
        apt-get -y install ${to_install}
    fi
fi

echo "Done!"