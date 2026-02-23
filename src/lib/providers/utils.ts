/** Extract the binary name from a full path, stripping extensions */
export function commandBin(command: string): string {
  const bin = command.split(/[\\/]/).pop() ?? command;
  return bin.replace(/\.(exe|cmd|bat)$/i, "").toLowerCase();
}

/** Generic flag value extractor supporting --flag=value, --flag value, and -f value */
export function valueAfterFlag(command: string[], longFlag: string, shortFlag?: string): string | undefined {
  const longInline = command.find((arg) => arg.startsWith(`${longFlag}=`));
  if (longInline) {
    const [, value] = longInline.split("=", 2);
    if (value) return value;
  }

  const longIndex = command.indexOf(longFlag);
  if (longIndex !== -1 && longIndex + 1 < command.length) {
    return command[longIndex + 1];
  }
  if (shortFlag) {
    const shortIndex = command.indexOf(shortFlag);
    if (shortIndex !== -1 && shortIndex + 1 < command.length) {
      return command[shortIndex + 1];
    }
  }
  return undefined;
}
