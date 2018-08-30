import Transaction from '../src/Transaction';

describe('transaction', () => {
    it('executes a transaction callback upon perform', async () => {
        const client = new (jest.fn())();
        const transactionCallback = jest.fn();

        const transaction = new Transaction(client, false, transactionCallback);
        await transaction.perform();

        expect(transactionCallback).toHaveBeenCalledTimes(1);
        expect(transactionCallback).toHaveBeenCalledWith(transaction);
    });

    it('executes a nested transaction callback upon perform', async () => {
        const client = new (jest.fn())();
        client.query = jest.fn();

        const nestedTransactionCallback = jest.fn();

        const transaction = new Transaction(client, false, async (connection) => {
            await connection.transaction(nestedTransactionCallback);
        });
        await transaction.perform();

        expect(nestedTransactionCallback).toHaveBeenCalledTimes(1);
        expect(nestedTransactionCallback).toHaveBeenCalledWith(new Transaction(client, false, nestedTransactionCallback, 1));

        expect(client.query).toHaveBeenCalledTimes(2);
        expect(client.query).toHaveBeenCalledWith({text: 'SAVEPOINT savepoint1', values: undefined});
        expect(client.query).toHaveBeenCalledWith({text: 'RELEASE SAVEPOINT savepoint1', values: undefined});
    });

    it('rollbacks a failing nested transaction callback upon perform', async () => {
        const client = new (jest.fn())();
        client.query = jest.fn();

        const nestedTransactionCallback = jest.fn(() => {
            throw new Error('Failing transaction');
        });

        const transaction = new Transaction(client, false, async (connection) => {
            await connection.transaction(nestedTransactionCallback);
        });
        await expect(transaction.perform())
            .rejects
            .toEqual(new Error('Failing transaction'));

        expect(nestedTransactionCallback).toHaveBeenCalledTimes(1);
        expect(nestedTransactionCallback).toHaveBeenCalledWith(new Transaction(client, false, nestedTransactionCallback, 1));

        expect(client.query).toHaveBeenCalledTimes(2);
        expect(client.query).toHaveBeenCalledWith({text: 'SAVEPOINT savepoint1', values: undefined});
        expect(client.query).toHaveBeenCalledWith({text: 'ROLLBACK TO SAVEPOINT savepoint1', values: undefined});
    });
});
