# Stripe + Discord Headless Integration
- Customer Portals

## Getting Started

### Installation
1. Create a Discord account, create a bot with OAuth2 redirect as ```http://<API DOMAIN>/auth/login/callback```, create a server and obtain information below.
2. Create a Stripe account, obtains api keys and create a subsciption plan.
3. Clone the repo
```sh
git clone https://github.com/sedkodes/stripe-discord-renewals-dashboard
```
4. Install NPM packages
```sh
cd backend
```
```sh
npm install
```

5. Configure config.json and Configure environment variables in a new `.env` file

### Running
In ```backend```
```
npm run dev
```