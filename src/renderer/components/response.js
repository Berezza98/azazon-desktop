export default class Response {
    constructor(success = true, msg = '', data = null){
        this.success = success;
        this.msg = msg;
        this.data = data;
    }
}