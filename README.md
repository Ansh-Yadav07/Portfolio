# Ansh Yadav, portfolio

My personal site. It's organised around what my models do: read, see, guard and plan. After that, visitors get a small neural network to train themselves.

## What's on it

| Section | What it does | Project |
|---|---|---|
| Hero | My name denoises out of static using the DDPM forward process, run in both directions as you scroll | |
| Read | Six checks run on a headline and produce a weighted verdict. You can also try the real 8 linguistic features in the browser | [Fake News Detection](https://github.com/Ansh-Yadav07/fake-news-detection-adv) |
| See | A sketch of on-device vegetable detection that follows your cursor | [PantryPilot AI](https://github.com/Ansh-Yadav07/PantryPilot-AI) |
| Guard | A simulated port scan, from alert to block | [MAVIS](https://github.com/Ansh-Yadav07/MAVIS) |
| Plan | A trip plan that draws itself as you scroll | [TravelGenie](https://github.com/Ansh-Yadav07/TravelGenie) |
| Learn | A real MLP with backpropagation written from scratch, training live on points you add | |
| Model card | My bio, written as an ML model card. If `public/ansh.jpg` exists, it shows as a "sample output" that denoises out of a halftone | |

The scores, confidences and trip budget in the animations are sample values, and the page labels them as samples or sketches. The headline metrics come from the projects themselves.

There's also Epoch, a small pixel bot who lives at the bottom of the page and reacts to what you do. And there are seven easter eggs. The model card has hints for most of them.

## Stack

Plain JavaScript and Canvas, built with [Vite](https://vite.dev). There's no UI framework and no animation library. Fonts are self-hosted through Fontsource.

## Run it

```bash
npm install
npm run dev
```

```bash
npm run build     # static site in dist/
npm run preview   # serve the build locally
```

## Layout

```
index.html        page content
public/           favicon, 404 page, share image, photo, resume.pdf, robots.txt and sitemap
src/main.js       startup, scroll progress, reveals
src/lib.js        shared helpers
src/styles.css    all styles
src/scenes/       one file per interactive section
src/bot/bot.js    Epoch, the pixel bot
src/eggs.js       easter eggs and their counter
```

## Contact

[anshy047@gmail.com](mailto:anshy047@gmail.com) · [LinkedIn](https://www.linkedin.com/in/ansh-yadav-83909b223) · [GitHub](https://github.com/Ansh-Yadav07)
