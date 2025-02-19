import { ErrorMsg } from 'src/utils'
import type { TokenOrDoc } from 'src/extensions'

export const helpers = {
	measureDistance(token: TokenOrDoc, target: TokenOrDoc) {
		return canvas.grid.measurePath([token, target])
	},
	measureDistanceFeet(token: TokenOrDoc, target: TokenOrDoc) {
		return this.measureDistance(token, target).distance
	},
	measureDistanceSpaces(token: TokenOrDoc, target: TokenOrDoc) {
		return this.measureDistance(token, target).spaces
	},
	parseOffsetEmbedded(options: { offset?: Offset } | undefined, source: Point, target: Point) {
		return { ...options, offset: (options?.offset ? this.parseOffset(options?.offset, source, target) : undefined) }
	},
	parseOffset(offset: Offset, source: Point, target: Point) {
		const result = {
			x: offset.x ?? 0,
			y: offset.y ?? 0,
		}
		if (Array.isArray(result.x))
			result.x = Sequencer.Helpers.random_float_between(result.x[0], result.x[1])
		if (Array.isArray(result.y))
			result.y = Sequencer.Helpers.random_float_between(result.y[0], result.y[1])

		if (offset.flip?.x && source.x > target.x)
			result.x *= -1
		if (offset.flip?.y && source.y > target.y)
			result.y *= -1

		return result
	},
	getCenterCoords(target: Target): Point | undefined {
		if (target instanceof TokenDocumentPF2e || target instanceof MeasuredTemplateDocumentPF2e) {
			return target._object?.center
		}
		if (target instanceof TokenPF2e || target instanceof MeasuredTemplatePF2e) {
			return target.center
		}
		return target
	},
	genericSequencerFunctions<T extends PresetKeys>(seq: EffectSection, _item: ItemPF2e, _target: Target, options?: EffectOptions<T>) {
		if (options?.scale)
			seq.scale(options.scale.min, options.scale.max)
		if (options?.scaleToObject)
			seq.scaleToObject(options.scaleToObject.value, options.scaleToObject)
		if (options?.filter)
			seq.filter(options.filter.type, options.filter.options)
		if (options?.waitUntilFinished)
			seq.waitUntilFinished(options?.waitUntilFinished)
		if (options?.locally)
			seq.locally(options.locally)
		if (options?.missed)
			seq.missed(options.missed)
		if (options?.rotate)
			seq.rotate(options.rotate ?? 0)
		if (options?.fadeIn)
			seq.fadeIn(options.fadeIn?.value, options.fadeIn)
		if (options?.fadeOut)
			seq.fadeOut(options.fadeOut?.value, options.fadeOut)
		if (options?.belowTokens)
			seq.belowTokens(options.belowTokens ?? false)
		if (options?.duration)
			seq.duration(options.duration)
		if (options?.randomizeMirrorX)
			seq.randomizeMirrorX(options.randomizeMirrorX)
		if (options?.randomizeMirrorY)
			seq.randomizeMirrorY(options.randomizeMirrorY)
		if (options?.repeats)
			seq.repeats(options.repeats.min, options.repeats.delay, options.repeats.max)
		if (options?.template)
			seq.template(options.template)

		// Adds new effects
		if (options?.shape)
			[options.shape].flat().forEach(shape => seq.shape(shape.value, shape))

		// Important Stuff
		if (options?.persist)
			seq.persist(options.persist?.value || false, options.persist)
		if (options?.tieToDocuments)
			seq.tieToDocuments([_item])
		if (options?.mask)
			seq.mask()

		if (options?.remove) {
			[options.remove].flat().forEach(origin => Sequencer.EffectManager.endEffects({ origin }))
		}

		seq.origin(options?.id ?? _item.uuid)
		seq.name(_item.name)

		return seq
	},
}

type presetOptions<T> =
	T extends 'onToken' ? ('target' | 'source' | 'both') :
	T extends 'ranged' ? { bounce: true, file: string } :
	never

interface EffectOptions<T extends PresetKeys> {
	preset: presetOptions<T>
	locally: boolean
	id: string
	randomizeMirrorX: boolean
	randomizeMirrorY: boolean
	remove: string | string[]
	tieToDocuments: true
	belowTokens: boolean
	waitUntilFinished: number
	duration: number
	rotate: number
	mask: true
	fadeIn: { value: number } & EasingOptions
	fadeOut: { value: number } & EasingOptions
	scale: {
		min: number | { x: number, y: number }
		max?: number
	}
	scaleToObject: { value: number } & Parameters<EffectSection['scaleToObject']>[1]
	filter: {
		type: Parameters<EffectSection['filter']>[0]
		options: Parameters<EffectSection['filter']>[1]
	}
	missed: boolean
	persist: { value: boolean } & Parameters<EffectSection['persist']>[1]
	attachTo: Parameters<EffectSection['attachTo']>[1]
	atLocation: Parameters<EffectSection['atLocation']>[1]
	stretchTo: Parameters<EffectSection['stretchTo']>[1]
	rotateTowards: Parameters<EffectSection['rotateTowards']>[1]
	anchor: Parameters<EffectSection['anchor']>[0]
	template: Parameters<EffectSection['template']>[0]
	repeats: {
		min: Parameters<EffectSection['repeats']>[0]
		delay: Parameters<EffectSection['repeats']>[1]
		max: Parameters<EffectSection['repeats']>[2]
	}
	shape: Shape | Shape[]
}

type Shape = { value: Parameters<EffectSection['shape']>[0] } & Parameters<EffectSection['shape']>[1]
type Offset = Point & { flip?: { x?: true, y?: true } }

export const presets = {
	ranged: (seq: Sequence, { file, targets, source, options, item }: PresetIndex['ranged']) => {
		if (!targets || !targets.length)
			throw new ErrorMsg('Ranged animation requires a target token!')
		if (!source)
			throw new ErrorMsg('Ranged animation requires a source token!')

		for (const [i, target] of targets.entries()) {
			const section = seq.effect()
				.stretchTo(target, helpers.parseOffsetEmbedded(options?.stretchTo, source, target))

			if (options?.preset?.bounce && i > 0) {
				section
					.atLocation(targets[i - 1], options?.atLocation)
					.file(options?.preset.file)
			} else {
				section
					.atLocation(source, options?.atLocation)
					.file(file)
			}

			helpers.genericSequencerFunctions(section, item, target, options)
		}

		return seq
	},
	melee: (seq: Sequence, { file, targets, source, options, item }: PresetIndex['melee']) => {
		if (!targets || !targets.length)
			throw new ErrorMsg('Melee animation requires a target token!')
		if (!source)
			throw new ErrorMsg('Melee animation requires a source token!')

		for (const target of targets) {
			const section = seq.effect()
				.file(file)
				.attachTo(source, helpers.parseOffsetEmbedded(options?.attachTo, source, target))
				.rotateTowards(target, helpers.parseOffsetEmbedded(options?.rotateTowards, source, target))

			helpers.genericSequencerFunctions(section, item, target, options)
		}

		return seq
	},
	onToken: (seq: Sequence, { file, targets, source, options, item }: PresetIndex['onToken']) => {
		const target = targets?.[0]
		const affectedToken = options?.preset === 'target' ? target : source

		if (!affectedToken)
			throw new ErrorMsg(`${options?.preset} is missing!`)

		const result = seq.effect()
			.file(file)
			.attachTo(affectedToken, helpers.parseOffsetEmbedded(options?.attachTo, affectedToken, target || affectedToken))
			.anchor(foundry.utils.mergeObject({ x: 0.5, y: 0.5 }, options?.anchor || {}))

		if (options?.rotateTowards)
			result.rotateTowards(target, helpers.parseOffsetEmbedded(options?.rotateTowards, affectedToken, target || affectedToken))

		return helpers.genericSequencerFunctions(result, item, affectedToken, options)
	},
	template: (seq: Sequence, { file, targets, options, item }: PresetIndex['template']) => {
		if (!targets || !targets.length)
			throw new ErrorMsg('Template animation requires a template!')

		for (const target of targets) {
			const section = seq.effect()
				.file(file)
				.attachTo(target, helpers.parseOffsetEmbedded(options?.attachTo, target, target))

			if (target.type === 'line' || target.type === 'cone')
				section.stretchTo(target, helpers.parseOffsetEmbedded(options?.stretchTo, target, target))

			helpers.genericSequencerFunctions(section, item, target, options)
		}

		return seq
	},
	macro: (seq: Sequence, data: PresetIndex['macro']) => seq.macro(data.macro, data),
	JSON: (seq: Sequence, jsonData: PresetIndex['JSON']) => seq.fromJSON(jsonData),
} as const

export type PresetKeys = keyof typeof presets

interface PresetIndex {
	ranged: GenericSequenceData<'ranged'>
	melee: GenericSequenceData<'melee'>
	onToken: GenericSequenceData<'onToken'>
	macro: MacroSequenceData
	template: TemplateSequenceData
	JSON: JSONSequenceData
}

interface GenericSequenceData<T extends PresetKeys> {
	sequence: Sequence
	file: string
	source?: TokenOrDoc
	targets?: Target[]
	item: ItemPF2e
	options?: EffectOptions<T>
}

type Target = (TokenOrDoc | MeasuredTemplateDocumentPF2e | Point)

type TemplateSequenceData = Omit<GenericSequenceData<'template'>, 'targets' | 'source'> & { targets?: MeasuredTemplateDocumentPF2e[], source?: TokenOrDoc }

type MacroSequenceData = GenericSequenceData<'JSON'> & { macro: string }
type JSONSequenceData = any

function applyPresets(override?: boolean) {
	Object.keys(presets).forEach((key) => {
		const preset = presets[key as PresetKeys]
		if (typeof preset !== 'function') {
			throw new TypeError(`Invalid preset ${key}`)
		}
		Sequencer.Presets.add(key, preset, override)
	})
}

Hooks.once('sequencerReady', () => applyPresets())

if (import.meta.hot) {
	// Prevents reloads
	import.meta.hot.accept()
	// Explicitly after
	import.meta.hot.on('vite:afterUpdate', (module) => {
		if (module) {
			applyPresets(true)
			ui.notifications.info('Updated presets.ts!')
		}
	})
}
