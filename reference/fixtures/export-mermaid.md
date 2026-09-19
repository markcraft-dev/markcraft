# Export fixture: Mermaid diagrams (R1 acceptance 1)

> Offline export must keep rendered Mermaid SVG inline (serialized from the live DOM).

## Architecture flowchart

```mermaid
flowchart TD
    A[Reader opens .md] --> B{Local file?}
    B -->|Yes| C[Folder tree + outline]
    B -->|No| D[Remote render]
    C --> E[Export single HTML]
    E --> F[Offline open identical]
```

## Sequence: export pipeline

```mermaid
sequenceDiagram
    participant U as User
    participant R as Reader
    participant E as Export
    U->>R: Click Export HTML
    R->>E: Clone live article
    E->>E: Inline images
    E->>E: Sanitize + template
    E-->>U: Download .html
```

## Plain content around diagrams

A paragraph between diagrams ensures layout survival, plus a table for mixed content:

| step | owner | offline |
| ---- | ----- | ------- |
| render | reader | yes |
| inline | export | yes |
| open | browser | yes |
