#!/usr/bin/env bash
#   Use this script to test if a given TCP host/port are available

WAITFORIT_cmdname=${0##*/}

echoerr() { if [[ $WAITFORIT_QUIET -ne 1 ]]; then echo "$@" 1>&2; fi }

usage()
{
    cat << USAGE >&2
Usage:
    $WAITFORIT_cmdname host:port [-s] [-t timeout] [-- command args]
    -h HOST | --host=HOST       Host or IP under test
    -p PORT | --port=PORT       TCP port under test
                                Alternatively, you specify the host and port as host:port
    -s | --strict               Only execute subcommand if the test succeeds
    -q | --quiet                Don't output any status messages
    -t TIMEOUT | --timeout=TIMEOUT
                                Timeout in seconds, zero for no timeout
    -- COMMAND ARGS             Execute command with args after the test finishes
USAGE
    exit 1
}

wait_for()
{
    if [[ "$WAITFORIT_HOST" == "" || "$WAITFORIT_PORT" == "" ]]; then
        echoerr "Error: you need to provide a host and port to test."
        usage
    fi

    WAITFORIT_start_ts=$(date +%s)
    while :
    do
        if [[ $WAITFORIT_TIMEOUT -gt 0 ]]; then
            WAITFORIT_cur_ts=$(date +%s)
            if [[ $((WAITFORIT_cur_ts - WAITFORIT_start_ts)) -ge $WAITFORIT_TIMEOUT ]]; then
                echoerr "Timeout occurred after waiting $WAITFORIT_TIMEOUT seconds for $WAITFORIT_HOST:$WAITFORIT_PORT"
                return 1
            fi
        fi
        (echo > /dev/tcp/$WAITFORIT_HOST/$WAITFORIT_PORT) >/dev/null 2>&1
        result=$?
        if [[ $result -eq 0 ]]; then
            if [[ $WAITFORIT_QUIET -ne 1 ]]; then
                echo "Connection to $WAITFORIT_HOST:$WAITFORIT_PORT succeeded"
            fi
            break
        fi
        sleep 1
    done
    return 0
}

WAITFORIT_HOST=""
WAITFORIT_PORT=""
WAITFORIT_TIMEOUT=15
WAITFORIT_STRICT=0
WAITFORIT_QUIET=0

while [[ $# -gt 0 ]]
do
    case "$1" in
        *:* )
        WAITFORIT_HOST="${1%:*}"
        WAITFORIT_PORT="${1##*:}"
        shift 1
        ;;
        -h)
        WAITFORIT_HOST="$2"
        shift 2
        ;;
        --host=*)
        WAITFORIT_HOST="${1#*=}"
        shift 1
        ;;
        -p)
        WAITFORIT_PORT="$2"
        shift 2
        ;;
        --port=*)
        WAITFORIT_PORT="${1#*=}"
        shift 1
        ;;
        -t)
        WAITFORIT_TIMEOUT="$2"
        shift 2
        ;;
        --timeout=*)
        WAITFORIT_TIMEOUT="${1#*=}"
        shift 1
        ;;
        -s|--strict)
        WAITFORIT_STRICT=1
        shift 1
        ;;
        -q|--quiet)
        WAITFORIT_QUIET=1
        shift 1
        ;;
        --)
        shift
        break
        ;;
        --help)
        usage
        ;;
        *)
        echoerr "Unknown argument: $1"
        usage
        ;;
    esac
done

wait_for
WAITFORIT_RESULT=$?

if [[ $WAITFORIT_STRICT -eq 1 && $WAITFORIT_RESULT -ne 0 ]]; then
    echoerr "$WAITFORIT_cmdname: strict mode, refusing to execute subprocess"
    exit $WAITFORIT_RESULT
fi

exec "$@"