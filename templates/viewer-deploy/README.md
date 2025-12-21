# Soroban Render Viewer Template

Deploy a full-featured viewer for your Soroban Render contract in minutes.

## Quick Start

### 1. Use This Template

Click **"Use this template"** on GitHub, or clone and push to your own repo:

```bash
git clone https://github.com/wyhaines/soroban-render.git
cp -r soroban-render/templates/viewer-deploy my-dapp
cd my-dapp
rm -rf .git && git init
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

### 2. Configure GitHub Secrets

Go to your repository **Settings > Secrets and variables > Actions** and add:

| Secret | Value | Example |
|--------|-------|---------|
| `VITE_CONTRACT_ID` | Your deployed contract ID | `CABC123...XYZ` |
| `VITE_NETWORK` | `testnet` or `mainnet` | `testnet` |

### 3. Enable GitHub Pages

Go to **Settings > Pages** and set:
- **Source**: GitHub Actions

### 4. Deploy

Push to `main` and GitHub Actions will automatically build and deploy:

```bash
git add .
git commit -m "Initial commit"
git push -u origin main
```

Your site will be live at `https://YOUR_USERNAME.github.io/YOUR_REPO/`


## Local Development

For local testing before deploying:

```bash
# Install dependencies
pnpm install

# Create .env from example
cp .env.example .env

# Edit .env with your contract ID
# VITE_CONTRACT_ID=your_contract_id
# VITE_NETWORK=testnet
# VITE_BASE_PATH=/

# Start dev server
pnpm dev
```

Open http://localhost:5173 to view your contract.


## Configuration

All configuration is done through environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CONTRACT_ID` | Yes | Your Soroban contract address |
| `VITE_NETWORK` | Yes | `testnet`, `mainnet`, or `local` |
| `VITE_BASE_PATH` | For GH Pages | Repository path (e.g., `/my-blog/`) |

### For GitHub Pages

The deploy workflow automatically sets `VITE_BASE_PATH` based on your repository name. Just add `VITE_CONTRACT_ID` and `VITE_NETWORK` as secrets.

### For Custom Domains

If you're using a custom domain with GitHub Pages, or deploying to Vercel/Netlify:
- Set `VITE_BASE_PATH=/` (or omit it)


## Customization

### Page Title

Edit `index.html` to change the page title and meta description:

```html
<title>My Blog</title>
<meta name="description" content="My blockchain-powered blog" />
```

### Favicon

Replace `public/favicon.svg` with your own icon.

### Styling

The viewer uses Tailwind CSS. Edit `src/index.css` to customize styles. The `.soroban-render-view` class scopes all rendered content styling.


## Deploying to Other Platforms

### Vercel

1. Import your repository on [Vercel](https://vercel.com)
2. Add environment variables in project settings
3. Deploy

### Netlify

1. Import your repository on [Netlify](https://netlify.com)
2. Set build command: `pnpm build`
3. Set publish directory: `dist`
4. Add environment variables in site settings
5. Deploy


## Features

This viewer includes everything from the main Soroban Render viewer:

- Wallet connection (Freighter)
- Transaction signing and submission
- Form handling
- Path-based navigation
- Markdown and JSON rendering
- Charts (pie, gauge, bar)
- Alert callouts
- Multi-column layouts
- Include resolution from other contracts


## Troubleshooting

### "Module not found" errors

Run `pnpm install` to install dependencies.

### Blank page after deploy

Check that `VITE_BASE_PATH` matches your deployment path. For GitHub Pages with repo name `my-blog`, use `/my-blog/`.

### Contract not loading

1. Verify your contract ID is correct
2. Check the network setting matches where your contract is deployed
3. Ensure your contract implements the `render()` function


## Learn More

- [Soroban Render Documentation](https://github.com/wyhaines/soroban-render/tree/main/docs)
- [Building Renderable Contracts](https://github.com/wyhaines/soroban-render/blob/main/docs/getting-started.md)
- [Markdown Format Reference](https://github.com/wyhaines/soroban-render/blob/main/docs/markdown-format.md)


## License

Apache 2.0
