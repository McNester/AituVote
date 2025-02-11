const Election = artifacts.require("Election");
const truffleAssert = require('truffle-assertions');

contract("Election", accounts => {
    let election;
    const owner = accounts[0];
    const voter1 = accounts[1];
    const voter2 = accounts[2];
    const nonVoter = accounts[3];

    beforeEach(async () => {
        election = await Election.new({ from: owner });
    });

    describe("Initial State", () => {
        it("should set the deployer as the owner", async () => {
            const contractOwner = await election.owner();
            assert.equal(contractOwner, owner, "Owner not set correctly");
        });

        it("should start in NotStarted state", async () => {
            const state = await election.electionState();
            assert.equal(state, 0, "Initial state should be NotStarted");
        });
    });

    describe("Adding Candidates", () => {

        it("should not allow non-owner to add candidates", async () => {
            await truffleAssert.reverts(
                election.addCandidate("Candidate 1", { from: voter1 }),
                "Only owner can add candidates"
            );
        });

        it("should not allow adding candidates after election starts", async () => {
            await election.startElection({ from: owner });
            await truffleAssert.reverts(
                election.addCandidate("Candidate 1", { from: owner }),
                "Election has already started"
            );
        });
    });

    describe("Voter Registration", () => {
        it("should allow owner to add voters before election starts", async () => {
            await election.addVoter(voter1, { from: owner });
            const voterRole = await election.getRole(voter1);
            assert.equal(voterRole, 2, "Voter role not set correctly");
        });

        it("should not allow adding duplicate voters", async () => {
            await election.addVoter(voter1, { from: owner });
            await truffleAssert.reverts(
                election.addVoter(voter1, { from: owner }),
                "Voter already added"
            );
        });

        it("should not allow non-owner to add voters", async () => {
            await truffleAssert.reverts(
                election.addVoter(voter2, { from: voter1 }),
                "Only owner can add voter"
            );
        });
    });

    describe("Election State Management", () => {
        it("should allow owner to start election", async () => {
            await election.startElection({ from: owner });
            const state = await election.electionState();
            assert.equal(state, 1, "Election state should be InProgress");
        });

        it("should allow owner to end election", async () => {
            await election.startElection({ from: owner });
            await election.endElection({ from: owner });
            const state = await election.electionState();
            assert.equal(state, 2, "Election state should be Ended");
        });

        it("should not allow non-owner to start election", async () => {
            await truffleAssert.reverts(
                election.startElection({ from: voter1 })
            );
        });

        it("should not allow starting an already started election", async () => {
            await election.startElection({ from: owner });
            await truffleAssert.reverts(
                election.startElection({ from: owner })
            );
        });
    });

    describe("Voting", () => {
        beforeEach(async () => {
            await election.addCandidate("Candidate 1", { from: owner });
            await election.addCandidate("Candidate 2", { from: owner });
            await election.addVoter(voter1, { from: owner });
            await election.addVoter(voter2, { from: owner });
            await election.startElection({ from: owner });
        });

        it("should emit Voted event", async () => {
            const result = await election.vote(0, { from: voter1 });
            truffleAssert.eventEmitted(result, 'Voted', (ev) => {
                return ev._candidateId.toNumber() === 0;
            });
        });

        it("should not allow voting before election starts", async () => {
            const newElection = await Election.new({ from: owner });
            await newElection.addCandidate("Candidate 1", { from: owner });
            await newElection.addVoter(voter1, { from: owner });
            
            await truffleAssert.reverts(
                newElection.vote(0, { from: voter1 }),
                "Election is not in progress"
            );
        });

        it("should not allow voting after election ends", async () => {
            await election.endElection({ from: owner });
            await truffleAssert.reverts(
                election.vote(0, { from: voter1 }),
                "Election is not in progress"
            );
        });

        it("should not allow voting twice", async () => {
            await election.vote(0, { from: voter1 });
            await truffleAssert.reverts(
                election.vote(1, { from: voter1 }),
                "You have already voted"
            );
        });

        it("should not allow non-registered voters to vote", async () => {
            await truffleAssert.reverts(
                election.vote(0, { from: nonVoter }),
                "Non authorised user cannot vote"
            );
        });

        it("should not allow voting for invalid candidate", async () => {
            await truffleAssert.reverts(
                election.vote(99, { from: voter1 }),
                "Invalid candidate ID"
            );
        });
    });

    describe("Role Management", () => {
        beforeEach(async () => {
            await election.addVoter(voter1, { from: owner });
        });

        it("should correctly identify owner role", async () => {
            const role = await election.getRole(owner);
            assert.equal(role, 1, "Owner role should be 1");
        });

        it("should correctly identify voter role", async () => {
            const role = await election.getRole(voter1);
            assert.equal(role, 2, "Voter role should be 2");
        });

        it("should correctly identify non-voter role", async () => {
            const role = await election.getRole(nonVoter);
            assert.equal(role, 3, "Non-voter role should be 3");
        });
    });
});
