const COMPLETION_SHELLS = ['bash', 'zsh'];
const HELP_COMMANDS = ['completion', 'doctor', 'help', 'new', 'routes', 'test', 'version'];
const ROOT_COMMANDS = ['completion', 'doctor', 'help', 'new', 'routes', 'test', 'version'];
export function isCompletionShell(value) {
    return COMPLETION_SHELLS.includes(value);
}
export function getCompletionResult(words, currentIndex) {
    let resolvedIndex = Math.max(0, currentIndex);
    let currentWord = words[resolvedIndex] ?? '';
    let tokens = getTokensBeforeCursor(words, resolvedIndex);
    return completeTopLevel(tokens, currentWord);
}
export function renderCompletionResult(result) {
    let lines = [`mode:${result.mode}`];
    if (result.mode === 'values') {
        lines.push(...(result.values ?? []));
    }
    return `${lines.join('\n')}\n`;
}
export function getCompletionScript() {
    return `###-begin-remix-completion-###
#
# Remix command completion script
#
# Installation:
#   remix completion bash >> ~/.bashrc
#   remix completion zsh >> ~/.zshrc
#

if type complete &>/dev/null; then
  _remix_completion() {
    local words cword current output mode si
    local lines

    if type _get_comp_words_by_ref &>/dev/null; then
      _get_comp_words_by_ref -w words -i cword
    else
      cword="$COMP_CWORD"
      words=("\${COMP_WORDS[@]}")
    fi

    current="\${words[cword]}"
    output=$(remix completion -- "$cword" "\${words[@]}" 2>/dev/null) || return 0
    si="$IFS"
    IFS=$'\\n' lines=($output)
    IFS="$si"
    mode="\${lines[0]}"

    if [[ "$mode" == "mode:values" ]]; then
      COMPREPLY=("\${lines[@]:1}")
      return 0
    fi

    if [[ "$mode" == "mode:files" ]]; then
      COMPREPLY=($(compgen -f -- "$current"))
      return 0
    fi

    COMPREPLY=()
  }

  complete -o default -F _remix_completion remix
elif type compdef &>/dev/null; then
  _remix_completion() {
    local output mode
    local -a lines values

    output=$(remix completion -- "$((CURRENT - 1))" "\${words[@]}" 2>/dev/null) || return 0
    lines=("\${(@f)output}")
    mode="\${lines[1]}"

    if [[ "$mode" == "mode:values" ]]; then
      values=("\${(@)lines[2,-1]}")
      if (( \${#values[@]} > 0 )); then
        compadd -- "\${values[@]}"
      fi
      return 0
    fi

    if [[ "$mode" == "mode:files" ]]; then
      if autoload -U +X _files 2>/dev/null; then
        _files
      else
        compadd -f
      fi
      return 0
    fi

    return 0
  }

  compdef _remix_completion remix
fi
###-end-remix-completion-###
`;
}
function completeTopLevel(tokens, currentWord) {
    let usedFlags = new Set();
    let index = 0;
    while (index < tokens.length) {
        let token = tokens[index];
        if (token === '--no-color') {
            usedFlags.add('--no-color');
            index++;
            continue;
        }
        if (token === '-h' || token === '--help') {
            usedFlags.add('-h');
            return completeValues([], currentWord);
        }
        if (token === '-v' || token === '--version') {
            usedFlags.add('-v');
            return completeValues([], currentWord);
        }
        return completeCommand(token, tokens.slice(index + 1), currentWord, usedFlags);
    }
    return completeValues(getTopLevelSuggestions(currentWord, usedFlags), currentWord);
}
function completeCommand(command, tokens, currentWord, usedGlobalFlags) {
    if (command === 'help') {
        return completeHelp(tokens, currentWord, usedGlobalFlags);
    }
    if (command === 'new') {
        return completeNew(tokens, currentWord, usedGlobalFlags);
    }
    if (command === 'doctor') {
        return completeSimpleFlags(tokens, currentWord, usedGlobalFlags, [
            '--fix',
            '--json',
            '--strict',
        ]);
    }
    if (command === 'routes') {
        return completeRoutes(tokens, currentWord, usedGlobalFlags);
    }
    if (command === 'version') {
        return completeSimpleFlags(tokens, currentWord, usedGlobalFlags, []);
    }
    if (command === 'test') {
        return completeSimpleFlags(tokens, currentWord, usedGlobalFlags, ['--coverage', '--watch']);
    }
    if (command === 'completion') {
        return completeCompletionCommand(tokens, currentWord, usedGlobalFlags);
    }
    return completeValues([], currentWord);
}
function completeHelp(tokens, currentWord, usedGlobalFlags) {
    let filteredTokens = filterGlobalCommandTokens(tokens, usedGlobalFlags);
    if (filteredTokens == null) {
        return completeValues([], currentWord);
    }
    if (filteredTokens.length === 0) {
        return completeValues(withHelpFlags([...HELP_COMMANDS], usedGlobalFlags), currentWord);
    }
    let [, ...rest] = filteredTokens;
    if (rest.length === 0) {
        return completeValues([], currentWord);
    }
    return completeValues([], currentWord);
}
function completeNew(tokens, currentWord, usedGlobalFlags) {
    let filteredTokens = filterGlobalCommandTokens(tokens, usedGlobalFlags);
    if (filteredTokens == null) {
        return completeValues([], currentWord);
    }
    let hasAppName = false;
    let hasForce = false;
    let hasTargetDir = false;
    let expectsAppName = false;
    for (let token of filteredTokens) {
        if (expectsAppName) {
            expectsAppName = false;
            continue;
        }
        if (token === '--app-name') {
            hasAppName = true;
            expectsAppName = true;
            continue;
        }
        if (token === '--force') {
            hasForce = true;
            continue;
        }
        if (token.startsWith('-')) {
            return completeValues([], currentWord);
        }
        if (!hasTargetDir) {
            hasTargetDir = true;
            continue;
        }
        return completeValues([], currentWord);
    }
    if (expectsAppName) {
        return { mode: 'none' };
    }
    let flags = withHelpFlags([...(!hasAppName ? ['--app-name'] : []), ...(!hasForce ? ['--force'] : [])], usedGlobalFlags);
    if (!hasTargetDir && !currentWord.startsWith('-')) {
        return { mode: 'files' };
    }
    return completeValues(flags, currentWord);
}
function completeRoutes(tokens, currentWord, usedGlobalFlags) {
    let filteredTokens = filterGlobalCommandTokens(tokens, usedGlobalFlags);
    if (filteredTokens == null) {
        return completeValues([], currentWord);
    }
    let hasJson = false;
    let hasNoHeaders = false;
    let hasTable = false;
    let hasVerbose = false;
    for (let token of filteredTokens) {
        if (token === '--json') {
            hasJson = true;
            continue;
        }
        if (token === '--table') {
            hasTable = true;
            continue;
        }
        if (token === '--no-headers') {
            hasNoHeaders = true;
            continue;
        }
        if (token === '--verbose') {
            hasVerbose = true;
            continue;
        }
        return completeValues([], currentWord);
    }
    let flags = withHelpFlags([
        ...(!hasJson && !hasTable && !hasVerbose ? ['--json'] : []),
        ...(!hasTable && !hasJson ? ['--table'] : []),
        ...(!hasNoHeaders && hasTable ? ['--no-headers'] : []),
        ...(!hasVerbose && !hasJson ? ['--verbose'] : []),
    ], usedGlobalFlags);
    return completeValues(flags, currentWord);
}
function completeCompletionCommand(tokens, currentWord, usedGlobalFlags) {
    let filteredTokens = filterGlobalCommandTokens(tokens, usedGlobalFlags);
    if (filteredTokens == null) {
        return completeValues([], currentWord);
    }
    if (filteredTokens.length === 0) {
        return completeValues(withHelpFlags([...COMPLETION_SHELLS], usedGlobalFlags), currentWord);
    }
    return completeValues([], currentWord);
}
function completeSimpleFlags(tokens, currentWord, usedGlobalFlags, commandFlags) {
    let filteredTokens = filterGlobalCommandTokens(tokens, usedGlobalFlags);
    if (filteredTokens == null) {
        return completeValues([], currentWord);
    }
    let usedFlags = new Set();
    for (let token of filteredTokens) {
        if (!commandFlags.includes(token)) {
            return completeValues([], currentWord);
        }
        usedFlags.add(token);
    }
    let availableFlags = commandFlags.filter((flag) => !usedFlags.has(flag));
    return completeValues(withHelpFlags(availableFlags, usedGlobalFlags), currentWord);
}
function getTopLevelSuggestions(currentWord, usedFlags) {
    let flags = [
        ...(!usedFlags.has('-h') ? ['-h', '--help'] : []),
        ...(!usedFlags.has('--no-color') ? ['--no-color'] : []),
        ...(!usedFlags.has('-v') ? ['-v', '--version'] : []),
    ];
    if (currentWord.startsWith('-')) {
        return flags;
    }
    return [...ROOT_COMMANDS, ...flags];
}
function withHelpFlags(values, usedGlobalFlags) {
    return [
        ...values,
        ...(!usedGlobalFlags.has('-h') ? ['-h', '--help'] : []),
        ...(!usedGlobalFlags.has('--no-color') ? ['--no-color'] : []),
    ];
}
function filterGlobalCommandTokens(tokens, usedGlobalFlags) {
    let filtered = [];
    for (let token of tokens) {
        if (token === '--no-color') {
            usedGlobalFlags.add('--no-color');
            continue;
        }
        if (token === '-h' || token === '--help') {
            usedGlobalFlags.add('-h');
            return null;
        }
        filtered.push(token);
    }
    return filtered;
}
function completeValues(values, currentWord) {
    return {
        mode: 'values',
        values: values.filter((value) => value.startsWith(currentWord)),
    };
}
function getTokensBeforeCursor(words, currentIndex) {
    let startIndex = words[0] === 'remix' ? 1 : 0;
    let endIndex = Math.max(startIndex, Math.min(currentIndex, words.length));
    return words.slice(startIndex, endIndex);
}
