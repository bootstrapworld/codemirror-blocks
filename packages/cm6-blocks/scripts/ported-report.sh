#!/bin/bash
# usage: ported-report.sh <ported spec name without path, e.g. activation>: runs it and lists each failing test with the first lines of its message
cd "$(dirname "$0")/../../.."
npx jest packages/cm6-blocks/spec/ported/$1 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | awk '
/^  ● /{ if(name!="" && !seen[name]++) print "FAIL: " name "\n    " msg; name=substr($0,5); msg=""; n=0; next }
/^Tests:/{ if(name!="" && !seen[name]++) print "FAIL: " name "\n    " msg; name=""; print; next }
name!="" && n<5 && NF>0 && $0 !~ /^\s+at / && $0 !~ /^\s+[0-9]+ \|/ && $0 !~ /^\s+>/ { msg=msg " | " $0; n++ }'
