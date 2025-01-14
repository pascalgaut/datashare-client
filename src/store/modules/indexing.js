import { remove } from 'lodash'
import { getField, updateField } from 'vuex-map-fields'
import Vue from 'vue'

import Api from '@/api'

export const api = new Api()

export function initialState () {
  return {
    form: {
      filter: true,
      ocr: false,
      offline: false,
      pipeline: 'CORENLP'
    },
    tasks: []
  }
}

export const state = initialState()

export const getters = {
  getField
}

export const mutations = {
  updateField,
  reset (state) {
    // acquire initial state
    const s = initialState()
    Object.keys(s).forEach(key => { state[key] = s[key] })
  },
  stopPendingTasks (state) {
    remove(state.tasks, item => item.state === 'RUNNING')
  },
  stopTask (state, name) {
    remove(state.tasks, item => item.name === name)
  },
  deleteDoneTasks (state) {
    remove(state.tasks, item => item.state === 'DONE')
  },
  updateTasks (state, raw) {
    Vue.set(state, 'tasks', raw)
  },
  resetExtractForm (state) {
    state.form.ocr = initialState().form.ocr
  },
  resetFindNamedEntitiesForm (state) {
    state.form.pipeline = initialState().form.pipeline
    state.form.offline = initialState().form.offline
  }
}

export const actions = {
  submitExtract ({ state }) {
    return api.index({ ocr: state.form.ocr, filter: state.form.filter })
  },
  runBatchSearch () {
    return api.runBatchSearch()
  },
  submitFindNamedEntities ({ state }) {
    return api.findNames(state.form.pipeline, { syncModels: !state.form.offline })
  },
  async stopPendingTasks ({ commit }) {
    try {
      await api.stopPendingTasks()
      return commit('stopPendingTasks')
    } catch (_) {}
  },
  async stopTask ({ commit }, name) {
    try {
      await api.stopTask(name)
      commit('stopTask', name)
    } catch (_) {}
  },
  async deleteDoneTasks ({ commit }) {
    try {
      await api.deleteDoneTasks()
      commit('deleteDoneTasks')
    } catch (_) {}
  },
  async getTasks ({ commit }) {
    try {
      const tasks = await api.getTasks()
      commit('updateTasks', tasks)
    } catch (_) {
      commit('updateTasks', [])
    }
  },
  async deleteAll ({ rootState }) {
    for (const index of rootState.search.indices) {
      await api.deleteAll(index)
    }
  },
  getNerPipelines () {
    return api.getNerPipelines()
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
