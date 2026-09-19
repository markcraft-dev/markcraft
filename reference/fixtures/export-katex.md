# Export fixture: KaTeX math (R1 acceptance 1)

> Offline export must inline KaTeX CSS so formulas render without network.

## Inline math

The quadratic formula $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$ renders inline,
as does Euler's identity $e^{i\pi} + 1 = 0$ and a sum $\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$.

## Display math

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

$$
\begin{bmatrix}
a & b \\
c & d
\end{bmatrix}
\begin{bmatrix}
x \\
y
\end{bmatrix}
=
\begin{bmatrix}
ax + by \\
cx + dy
\end{bmatrix}
$$

## Mixed with headings and code

### A subsection with math

Inline $\alpha + \beta = \gamma$ inside a subsection, then a code span `O(n log n)`.
