To redeploy to production, simply run:

  vercel --prod

  This command will:
  - Upload your current code (including uncommitted changes)
  - Build the app on Vercel's servers
  - Deploy to production
  - Update all your production URLs automatically

  Other useful commands:

  # Preview deployment (not production)
  vercel

  # Check deployment status
  vercel ls

  # View build logs of latest deployment
  vercel inspect <deployment-url> --logs

  # Check which deployments are live
  vercel alias ls

  Note: vercel --prod deploys whatever code is currently in your local directory, whether it's committed to git or not. If you want to ensure
  you're deploying committed code, commit your changes first with git add and git commit.