import { randString, walk } from './util'
import logging from './logger'

const log = logging('render')

function walkElements (element, components, refs, subtree, bus) {
	for (const child of element.children) {
		const childName = child.nodeName.toLowerCase()
		const attrs = {}

		for (const attr of child.attributes) {
			const name = attr.name
			const value = attr.value

			if (value.indexOf('fig-ref-') === 0) {
				const id = value.slice('fig-ref-'.length)
				if (refs[id]) attrs[name] = refs[id]

				// remove all ugly refs from DOM
				child.removeAttribute(name)
			}

			if (!attrs[name]) attrs[name] = value

			if (name.indexOf('@') === 0) {
				const fn = attrs[name]
				if (typeof fn !== 'function')
					throw '@event listener must be a function'

				child.addEventListener(name.slice(1), function (e) {
					e.preventDefault()
					fn(e)
				})
			}
		}

		if (components.has(childName)) {
			subtree.children.push(render(child, attrs, components, bus))
		} else walkElements(child, components, refs, subtree, bus)
	}
}

const ref = prop => {
	const id = randString(10)

	Object.defineProperty(prop, 'toJSON', {
		configurable: true,
		enumerable: false,
		value: () => 'fig-ref-' + id
	})

	return id
}

const render = (element, opts, components, bus) => {
	log.info('rendering', element, 'with opts', opts)

	const name = element.nodeName.toLowerCase()
	const component = components.get(name)

	const subtree = {}
	subtree.name = name
	subtree.$el = element
	subtree.children = []

	const view = {}
	component.script.call(element, view, opts, bus)

	const refs = {}
	walk(o => {
		for (const key in o) {
			if (o.hasOwnProperty(key)) {
				const prop = o[key]
				if (['function', 'object'].indexOf(typeof prop) !== -1) {
					const id = ref(prop)
					refs[id] = prop
				}
			}
		}
	}, view)

	element.innerHTML = component.template(view)
	walkElements(element, components, refs, subtree, bus)

	return subtree
}

export default render