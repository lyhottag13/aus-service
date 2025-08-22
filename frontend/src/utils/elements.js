const elements = {
    visuals: {
        injectorTableBody: document.getElementById('injector-table-body'),

    },
    inputs: {
        injector: {
            injectorSerial: document.getElementById('injector-serial'),
            duty100Before: document.getElementById('duty-100-before'),
            duty100After: document.getElementById('duty-100-after'),
            duty50Before: document.getElementById('duty-50-before'),
            duty50After: document.getElementById('duty-50-after'),
            idleBefore: document.getElementById('idle-before'),
            idleAfter: document.getElementById('idle-after'),
        },
        order: {
            make: document.getElementById('make'),
            part: document.getElementById('part'),
            customer: document.getElementById('customer'),
            ohm: document.getElementById('ohm'),
            process: document.getElementById('process-select')
        }
    },
    buttons: {
        submit: document.getElementById('submit'),
        add: document.getElementById('add'),
        export: document.getElementById('export')
    }
}

export default elements;