export default class Good {
    constructor(name, asin, rank, last = false){
        this.name = name;
        this.asin = asin;
        this.rank = rank;
        this.last = last;
    }
}