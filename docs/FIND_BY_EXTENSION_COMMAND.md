# findByExtension Command

The `findByExtension` command provides fast filtering of files by specific extensions, with support for predefined extension groups and recursive search.

## Usage

```
findByExtension <extensions|group> [directory] [--hidden|-a] [--case-sensitive|-c] [--depth|-d <number>]
```

## Parameters

- `<extensions|group>`: File extensions to search for, or predefined group name
- `[directory]`: Directory to search in (default: current directory)
- `[--hidden|-a]`: Include hidden files (starting with .)
- `[--case-sensitive|-c]`: Case-sensitive extension matching
- `[--depth|-d <number>]`: Maximum search depth (default: 10)

## Extension Groups

The command supports predefined extension groups for common file types:

- **code**: `.js`, `.ts`, `.jsx`, `.tsx`, `.py`, `.java`, `.cpp`, `.c`, `.cs`, `.php`, `.rb`, `.go`, `.rs`, `.swift`, `.kt`
- **web**: `.html`, `.css`, `.scss`, `.sass`, `.less`, `.vue`, `.svelte`
- **docs**: `.md`, `.txt`, `.doc`, `.docx`, `.pdf`, `.rtf`, `.odt`
- **config**: `.json`, `.yaml`, `.yml`, `.toml`, `.ini`, `.conf`, `.config`
- **images**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.svg`, `.webp`, `.bmp`, `.ico`
- **media**: `.mp4`, `.avi`, `.mov`, `.wmv`, `.flv`, `.webm`, `.mp3`, `.wav`, `.flac`, `.ogg`
- **data**: `.csv`, `.xml`, `.sql`, `.db`, `.sqlite`, `.json`, `.parquet`

## Examples

### Find all TypeScript files
```
findByExtension .ts
```

### Find all code files in src directory
```
findByExtension code src
```

### Find multiple specific extensions
```
findByExtension .js,.ts,.jsx,.tsx
```

### Find config files including hidden ones
```
findByExtension config --hidden
```

### Find images with case-sensitive matching
```
findByExtension images --case-sensitive
```

### Limit search depth
```
findByExtension code --depth 3
```

## Output

The command returns a formatted list of matching files with:
- File name
- Full path
- File size (for files)
- Last modified date

Files are sorted by path for consistent output.

## Error Handling

- Returns appropriate error messages for invalid arguments
- Handles permission errors gracefully (logs warnings but continues search)
- Provides clear feedback when no files are found