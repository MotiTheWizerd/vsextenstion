export function generateToolNames(commandCalls: any[]): string[] {
    return commandCalls.map(call => {
        const args = call.args || [];
        switch (call.command) {
            case "read":
                const fileName = args[0] ? args[0].split(/[\/]/).pop() : "file";
                return `Reading ${fileName}`;
            case "searchRegex":
            case "searchText":
                const searchTerm = args[0] || "text";
                return `Searching "${searchTerm.length > 15 ? searchTerm.substring(0, 15) + "..." : searchTerm}"`;
            // Add other cases as needed
            default:
                return call.command;
        }
    });
}
