import { atob, btoa } from '../base64'
describe('atob & btoa', () => {
	it('atob and btoa with emoji', () => {
		const smile = '😁'
		const b = btoa(smile);
		const a = atob(b);
		expect(a).toEqual(smile);
	})


	it('atob and btoa with chinese characters', () => {
		const animal = '熊猫'
		const b = btoa(animal);
		const a = atob(b);
		expect(a).toEqual(animal);
	})

	it('atob and btoa with english characters', () => {
		const animal = 'panda'
		const b = btoa(animal);
		const a = atob(b);
		expect(a).toEqual(animal);
	})

	it('atob and btoa with object', () => {
		const object = {
			name: '熊猫',
			type: 'animal',
			age: 2
		}
		const b = btoa(JSON.stringify(object));
		const a = JSON.parse(atob(b));
		expect(a).toEqual(object);
	})
})
