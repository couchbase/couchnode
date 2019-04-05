const ReplicaMode = {
    All: -1,
    Any: 0,
    Replica1: 1,
    Replica2: 2,
    Replica3: 3,
};

module.exports.ReplicaMode = ReplicaMode;

const DurabilityLevel = {
    None: 0,
    Majority: 1,
    MajorityAndPersistOnMaster: 2,
    PersistToMajority: 3,
};

module.exports.DurabilityLevel = DurabilityLevel;
