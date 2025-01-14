import remove from 'lodash/remove'

import Api from '@/api'
import Vue from 'vue'

export const api = new Api()

export function initialState () {
  return {
    batchSearch: {},
    batchSearches: [],
    results: [],
    selectedQueries: [],
    total: 0
  }
}

export const state = initialState()

export const mutations = {
  reset (state) {
    Object.assign(state, initialState())
  },
  batchSearch (state, batchSearch) {
    Vue.set(state, 'batchSearch', batchSearch)
  },
  batchSearches (state, batchSearches) {
    Vue.set(state, 'batchSearches', batchSearches)
  },
  selectedQueries (state, selectedQueries) {
    Vue.set(state, 'selectedQueries', selectedQueries)
  },
  results (state, results) {
    Vue.set(state, 'results', results)
  },
  total (state, total) {
    Vue.set(state, 'total', total)
  }
}

export const actions = {
  async getBatchSearch ({ commit }, batchId) {
    let batchSearch = {}
    try {
      batchSearch = await api.getBatchSearch(batchId)
    } catch (_) {
      batchSearch = {}
    }
    return commit('batchSearch', batchSearch)
  },
  async getBatchSearches ({ commit }, { from = 0, size = 100, sort = 'batch_date', order = 'asc', query = '*', field = 'all' }) {
    let batchSearches = []
    try {
      batchSearches = await api.getBatchSearches(from, size, sort, order, query, field)
    } catch (_) {
      batchSearches = {
        items: [],
        total: 0
      }
    }
    commit('total', batchSearches.total)
    return commit('batchSearches', batchSearches.items)
  },
  async onSubmit ({ state, commit, dispatch }, { name, csvFile, description, projects, phraseMatch, fuzziness, fileTypes, paths, published }) {
    await api.batchSearch(name, csvFile, description, projects, phraseMatch, fuzziness, fileTypes, paths, published)
    return dispatch('getBatchSearches', {})
  },
  async getBatchSearchResults ({ commit }, { batchId, from, size, queries, sort, order }) {
    let results = []
    try {
      results = await api.getBatchSearchResults(batchId, from, size, queries, sort, order)
    } catch (_) {
      results = []
    }
    return commit('results', results)
  },
  async deleteBatchSearch ({ state }, { batchId }) {
    try {
      await api.deleteBatchSearch(batchId)
      remove(state.batchSearches, batchSearch => batchSearch === batchId)
      return true
    } catch (_) {
      return false
    }
  },
  async updateBatchSearch ({ state }, { batchId, published }) {
    try {
      await api.updateBatchSearch(batchId, published)
    } catch (_) {}
  },
  async deleteBatchSearches ({ commit }) {
    try {
      await api.deleteBatchSearches()
      return commit('batchSearches', [])
    } catch (_) {}
  }
}

export default {
  namespaced: true,
  state,
  mutations,
  actions
}
