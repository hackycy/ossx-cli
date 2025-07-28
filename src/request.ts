import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import type { IRequest } from './types'
import axios from 'axios'

export default class Request implements IRequest {
  private axiosInstance
  constructor() {
    this.axiosInstance = axios.create({
      timeout: 60 * 1000,
    })
  }

  setDefaults(config: AxiosRequestConfig): void {
    this.axiosInstance.defaults = Object.assign(this.axiosInstance.defaults, config)
  }

  async request<T, U>(config: AxiosRequestConfig<U>): Promise<AxiosResponse<T, U>> {
    return this.axiosInstance.request<T, any, U>(config)
  }
}
