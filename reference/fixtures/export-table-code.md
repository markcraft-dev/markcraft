# Export fixture: tables, code, images (R1 acceptance 1)

> Offline export must inline local/remote images as data: URLs (failures keep
> the original URL with a warning) and keep tables/code printable.

## GFM table

| feature | offline | print-safe |
| ------- | ------- | ---------- |
| images | data: URL | yes |
| code blocks | inline styles | no page split |
| task lists | kept | yes |

## Task list

- [x] Render tables
- [x] Highlight code
- [ ] Inline every image

## Code blocks

```js
async function inlineImagesInto(root, baseHref) {
  const imgs = Array.from(root.querySelectorAll('img'))
  await Promise.all(imgs.map(async (img) => {
    console.log('inlining', img.getAttribute('src'))
  }))
}
```

```python
def escape_html(value: str) -> str:
    return (value.replace('&', '&amp;')
                 .replace('<', '&lt;')
                 .replace('>', '&gt;'))
```

## Images

Local relative image (inlined when readable, otherwise kept as-is):

![local diagram](./assets/diagram.png)

Remote image (inlined when CORS allows, otherwise kept as-is):

![remote logo](https://example.com/assets/logo.png)

## Blockquote

> Exported HTML must survive the network being off:
> styles inline, images embedded, scripts stripped.
