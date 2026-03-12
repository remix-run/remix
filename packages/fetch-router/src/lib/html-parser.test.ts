import * as assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { parse } from './html-parser.ts'

// Use the landing-page fixture from bench/fixtures as a realistic HTML document.
// Expected counts were validated against node-html-parser's querySelectorAll.
let fixtureHtml = readFileSync(
  new URL('../../bench/fixtures/landing-page.html', import.meta.url),
  'utf-8',
)

// node-html-parser finds 222 elements; our parser also picks up <!DOCTYPE> as "!doctype"
const EXPECTED_TOTAL = 223
const EXPECTED_HEAD = 1
const EXPECTED_BODY = 1
const EXPECTED_DIV = 26
const EXPECTED_A = 47
const EXPECTED_IMG = 20
const EXPECTED_SCRIPT = 2
const EXPECTED_LINK = 3
const EXPECTED_META = 2
const EXPECTED_SECTION = 7
const EXPECTED_LI = 25

describe('parse()', () => {
  it('parses all elements from a realistic HTML document', () => {
    let elements = parse(fixtureHtml)
    assert.equal(elements.length, EXPECTED_TOTAL)
  })

  it('parses the correct number of head elements', () => {
    let elements = parse(fixtureHtml)
    let head = elements.filter((el) => el.name === 'head')
    assert.equal(head.length, EXPECTED_HEAD)
  })

  it('parses the correct number of body elements', () => {
    let elements = parse(fixtureHtml)
    let body = elements.filter((el) => el.name === 'body')
    assert.equal(body.length, EXPECTED_BODY)
  })

  it('parses the correct number of div elements', () => {
    let elements = parse(fixtureHtml)
    let divs = elements.filter((el) => el.name === 'div')
    assert.equal(divs.length, EXPECTED_DIV)
  })

  it('parses the correct number of anchor elements', () => {
    let elements = parse(fixtureHtml)
    let anchors = elements.filter((el) => el.name === 'a')
    assert.equal(anchors.length, EXPECTED_A)
  })

  it('parses the correct number of img elements', () => {
    let elements = parse(fixtureHtml)
    let imgs = elements.filter((el) => el.name === 'img')
    assert.equal(imgs.length, EXPECTED_IMG)
  })

  it('parses the correct number of script elements', () => {
    let elements = parse(fixtureHtml)
    let scripts = elements.filter((el) => el.name === 'script')
    assert.equal(scripts.length, EXPECTED_SCRIPT)
  })

  it('parses the correct number of link elements', () => {
    let elements = parse(fixtureHtml)
    let links = elements.filter((el) => el.name === 'link')
    assert.equal(links.length, EXPECTED_LINK)
  })

  it('parses the correct number of meta elements', () => {
    let elements = parse(fixtureHtml)
    let metas = elements.filter((el) => el.name === 'meta')
    assert.equal(metas.length, EXPECTED_META)
  })

  it('parses the correct number of section elements', () => {
    let elements = parse(fixtureHtml)
    let sections = elements.filter((el) => el.name === 'section')
    assert.equal(sections.length, EXPECTED_SECTION)
  })

  it('parses the correct number of list items', () => {
    let elements = parse(fixtureHtml)
    let lis = elements.filter((el) => el.name === 'li')
    assert.equal(lis.length, EXPECTED_LI)
  })

  it('extracts href attributes from anchor elements', () => {
    let elements = parse(fixtureHtml)
    let hrefs = elements
      .filter((el) => el.name === 'a')
      .map((el) => el.getAttribute('href'))
      .filter((href): href is string => href != null)

    assert.equal(hrefs.length, EXPECTED_A, 'every anchor should have an href')
    assert.ok(hrefs.includes('/features'), 'should include /features link')
    assert.ok(hrefs.includes('/signup'), 'should include /signup link')
  })

  it('extracts src attributes from img elements', () => {
    let elements = parse(fixtureHtml)
    let srcs = elements
      .filter((el) => el.name === 'img')
      .map((el) => el.getAttribute('src'))
      .filter((src): src is string => src != null)

    assert.equal(srcs.length, EXPECTED_IMG, 'every img should have a src')
    assert.ok(srcs.includes('/images/logo.svg'), 'should include /images/logo.svg')
    assert.ok(srcs.includes('/images/hero-screenshot.png'), 'should include /images/hero-screenshot.png')
  })

  it('parses a simple HTML snippet correctly', () => {
    let elements = parse('<div class="test"><a href="/home">Home</a></div>')

    assert.equal(elements.length, 2)
    assert.equal(elements[0].name, 'div')
    assert.equal(elements[0].getAttribute('class'), 'test')
    assert.equal(elements[1].name, 'a')
    assert.equal(elements[1].getAttribute('href'), '/home')
  })

  it('handles self-closing tags', () => {
    let elements = parse('<img src="/photo.jpg" /><br /><input type="text" />')

    assert.equal(elements.length, 3)
    assert.equal(elements[0].name, 'img')
    assert.equal(elements[0].getAttribute('src'), '/photo.jpg')
    assert.equal(elements[1].name, 'br')
    assert.equal(elements[2].name, 'input')
    assert.equal(elements[2].getAttribute('type'), 'text')
  })

  it('skips HTML comments', () => {
    let elements = parse('<!-- this is a comment --><div>content</div>')

    assert.equal(elements.length, 1)
    assert.equal(elements[0].name, 'div')
  })

  it('handles boolean attributes', () => {
    let elements = parse('<input disabled required type="checkbox" />')

    assert.equal(elements.length, 1)
    assert.equal(elements[0].getAttribute('disabled'), '')
    assert.equal(elements[0].getAttribute('required'), '')
    assert.equal(elements[0].getAttribute('type'), 'checkbox')
  })
})
