# Virtual poster session

Virtual poster session with RPG-like UX.

&copy; 2020 Hiroyuki Kai

## Project setup

Prerequisite (if not installed yet)

```
brew update && brew install redis postgresql ghostscript
```

Install dependencies in node_modules

```
yarn
```

## Starting and stopping DB

In Mac OS

```
brew services start redis
brew services stop redis
```

## Setting environmental variables

Set `app_config.yaml` file. See `app_config.example.yaml` file for details.

## Testing

First run the server by the following commands

```
DEBUG_TOKEN=xxxx DEBUG_AS=xxxx NODE_TEST=1 yarn server
```

```
yarn test
```

## Compiles and hot-reloads for development

Run threen different windows:

API server

```
yarn server
```

Socket server

```
DEBUG_TOKEN=xxxx DEBUG_TOKEN=xxxx yarn socket
```

Client

```
yarn serve
```

For linting, run the following.

```
yarn lint
```

## For production

Compiles and minifies for production

```
yarn build
```

After build, run in production mode

```
sudo yarn prod
```

With logging:

```
sudo yarn prod:log
```

Nohup (starting from SSH):

```
sudo yarn nohup
```

## Make an admin account

Send a GET request to `/api/init_admin?email=<admin email>`
This endpoint is only available before the first admin account is made.

## External resouces used in the program

The author is grateful to the creators of the fantastic images and icons shown below.

### Map and character images

Pipoya souko (https://pipoya.net/sozai/)

### Icons

This program uses icons created by Flaticon.

<div>Icons made by <a href="https://www.flaticon.com/authors/chanut" title="Chanut">Chanut</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>
