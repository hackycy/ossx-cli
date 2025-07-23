import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import type { IRequest } from './types'
import axios from 'axios'

export default class Request implements IRequest {
  private readonly axiosInstance
  constructor() {
    this.axiosInstance = axios.create()
  }

  async request<T, U>(config: AxiosRequestConfig<U>): Promise<AxiosResponse<T, U>> {
    return this.axiosInstance.request<T, any, U>(config)
  }
}
