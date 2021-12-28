/** Upload and proxying blacklist. In the future this will live on-chain. */

interface Blacklist<T> {
    includes: (item: T) => boolean
}

// For proxying
/* tslint:disable:max-line-length */
export const imageBlacklist: Blacklist<string> = [
    'https://img.esteem.ws/b8r4fg7p4n.jpg',
    'http://i.imgsafe.org/c5e248b26c.jpg',
    'https://i.imgur.com/0XObSlG.jpg',
    'https://ipfs.pics/ipfs/QmXz6jNVkH2FyMEUtXSAvbPN4EwG1uQJzDBq7gQCJs1Nym',
    'https://s14.postimg.org/qjbmzlvap/The_man_from_taured_RZ.jpg',
    'http://carterlandscapephotography.com.au/wp-content/uploads/2013/04/Country-Light.jpg',
    'https://iso.500px.com/wp-content/uploads/2015/06/filters_cover.jpeg',
    'http://image.ibb.co/minGCF/aa_lenie_urbina_avielle_richman_meme.png',
    'https://steemitimages.com/DQmV858o66qa9wSBQCD6nu7xv45UVsvcNzsQpu9K6FrV1c2/19.jpg',
    'https://images.hive.blog/DQmNvk94uq6VAgS3t4zAeQCezGCToqGNsUkv4fkPo4NwVDm/image.png'
]
