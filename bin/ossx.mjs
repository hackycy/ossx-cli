#!/usr/bin/env node
'use strict'
import('../dist/cli.mjs')
  .then(r => r.bootstrap())
