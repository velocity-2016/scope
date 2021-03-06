#!/bin/bash

mkdir -p /var/run/weave

if [ "$1" = "version" -o "$1" = "help" ]; then
    exec -a scope /home/weave/scope --mode $1
    exit 0
fi

for arg in $@; do
    case "$arg" in
        --no-app|--probe-only|--service-token*|--probe.token*)
            touch /etc/service/app/down
            ;;
        --no-probe|--app-only)
            touch /etc/service/probe/down
            ;;
    esac
done

echo "$@" >/var/run/weave/scope-app.args
echo "$@" >/var/run/weave/scope-probe.args

exec /home/weave/runsvinit
