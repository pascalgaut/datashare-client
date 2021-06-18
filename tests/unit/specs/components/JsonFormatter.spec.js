import { createLocalVue, mount } from '@vue/test-utils'

import JsonFormatter from '@/components/JsonFormatter'
import { Core } from '@/core'

describe('JsonFormatter.vue', () => {
  const { localVue } = Core.init(createLocalVue()).useAll()
  let wrapper

  beforeEach(async () => {
    wrapper = mount(JsonFormatter, { localVue, propsData: { json: ['foo', 'bar'] } })
    await wrapper.vm.$nextTick()
  })

  afterAll(() => jest.unmock('axios'))

  it('should render an array of 1 element', () => {
    expect(wrapper.find('.json-formatter-row:nth-child(1) .json-formatter-value').text()).toBe('Array[2]')
  })

  it('should render an open row', async () => {
    expect(wrapper.find('.json-formatter-row.json-formatter-open').exists()).toBeTruthy()
  })
})
