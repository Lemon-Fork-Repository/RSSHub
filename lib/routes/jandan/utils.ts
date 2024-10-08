export function trimTitleDesc(prefix: string, suffix: string) {
    suffix = suffix.replaceAll('[查看原图]', '').trim();
    prefix = prefix.trim();

    if (suffix) {
        return `${prefix}: ${suffix}`;
    }
    return prefix;
}
